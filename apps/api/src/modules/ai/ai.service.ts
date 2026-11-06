import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { AppConfig } from '../../config/index.js';
import { Payment, RentSchedule } from '../../models/finance.js';
import { Lease, Tenant } from '../../models/lease.js';
import { MaintenanceTicket, Transaction } from '../../models/operations.js';
import { Property, Unit } from '../../models/property.js';
import { AIConversation, AIUsage } from '../../models/platform.js';

export interface ToolResult {
  name: string;
  data: Record<string, unknown>;
}

type Tool = (organizationId: string) => Promise<Record<string, unknown>>;

const TOOLS: Record<string, Tool> = {
  async getRentSummary(organizationId) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [monthlyCollected, allTimeCollected, monthlyExpected] = await Promise.all([
      Payment.aggregate<{ total: number }>([
        {
          $match: {
            organizationId: orgObjectId,
            paidAt: { $gte: startOfMonth },
            status: { $ne: 'REFUNDED' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
      Payment.aggregate<{ total: number }>([
        { $match: { organizationId: orgObjectId, status: { $ne: 'REFUNDED' } } },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
      RentSchedule.aggregate<{ total: number }>([
        {
          $match: {
            organizationId: orgObjectId,
            dueDate: { $gte: startOfMonth },
            status: { $ne: 'CANCELLED' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountDueMinor' } } },
      ]),
    ]);

    const monthlyMinor = monthlyCollected[0]?.total ?? 0;
    const totalMinor = allTimeCollected[0]?.total ?? 0;
    const expectedMinor = monthlyExpected[0]?.total ?? 0;
    const recoveryRate =
      expectedMinor === 0 ? 100 : Math.round((monthlyMinor / expectedMinor) * 100);

    return {
      monthlyCollectedMinor: monthlyMinor,
      allTimeCollectedMinor: totalMinor,
      monthlyExpectedMinor: expectedMinor,
      recoveryRate,
    };
  },

  async getOverdueRents(organizationId) {
    const rows = await RentSchedule.find({ organizationId, status: 'OVERDUE' })
      .populate<{ tenantId: { fullName: string; phone?: string } }>('tenantId', 'fullName phone')
      .limit(10)
      .select('amountDueMinor amountPaidMinor penaltyMinor dueDate tenantId');

    const totalOverdueMinor = rows.reduce(
      (sum, r) => sum + (r.amountDueMinor + (r.penaltyMinor || 0) - r.amountPaidMinor),
      0,
    );

    const debtors = rows.map((r) => {
      const daysOverdue = Math.max(
        0,
        Math.floor((Date.now() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      );
      return {
        tenantName: r.tenantId?.fullName ?? 'Locataire inconnu',
        amountDueMinor: r.amountDueMinor + (r.penaltyMinor || 0) - r.amountPaidMinor,
        daysOverdue,
        dueDate: r.dueDate.toISOString().slice(0, 10),
      };
    });

    return {
      count: rows.length,
      totalOverdueMinor,
      debtors,
    };
  },

  async getPropertyOccupancy(organizationId) {
    const total = await Unit.countDocuments({ organizationId, deletedAt: null });
    const occupied = await Unit.countDocuments({
      organizationId,
      status: 'OCCUPIED',
      deletedAt: null,
    });
    const available = await Unit.countDocuments({
      organizationId,
      status: 'AVAILABLE',
      deletedAt: null,
    });
    const maintenance = await Unit.countDocuments({
      organizationId,
      status: 'MAINTENANCE',
      deletedAt: null,
    });
    const occupancyRate = total === 0 ? 0 : Math.round((occupied / total) * 100);
    const vacancyRate = total === 0 ? 0 : Math.max(0, 100 - occupancyRate);

    return { total, occupied, available, maintenance, occupancyRate, vacancyRate };
  },

  async getMostProfitableProperty(organizationId) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const properties = await Property.find({ organizationId, deletedAt: null }).select(
      'name type city',
    );

    const profitability = await Promise.all(
      properties.map(async (prop) => {
        const [income, expenses] = await Promise.all([
          Transaction.aggregate<{ total: number }>([
            {
              $match: {
                organizationId: orgObjectId,
                propertyId: prop._id,
                direction: 'INCOME',
                deletedAt: null,
              },
            },
            { $group: { _id: null, total: { $sum: '$amountMinor' } } },
          ]),
          Transaction.aggregate<{ total: number }>([
            {
              $match: {
                organizationId: orgObjectId,
                propertyId: prop._id,
                direction: 'EXPENSE',
                deletedAt: null,
              },
            },
            { $group: { _id: null, total: { $sum: '$amountMinor' } } },
          ]),
        ]);

        const inc = income[0]?.total ?? 0;
        const exp = expenses[0]?.total ?? 0;
        return {
          id: prop._id,
          name: prop.name,
          type: prop.type,
          city: prop.city,
          incomeMinor: inc,
          expensesMinor: exp,
          netProfitMinor: inc - exp,
        };
      }),
    );

    profitability.sort((a, b) => b.netProfitMinor - a.netProfitMinor);
    const top = profitability[0];

    return {
      topProperty: top ?? null,
      ranking: profitability.slice(0, 5),
    };
  },

  async getVacantProperties(organizationId) {
    const vacantUnits = await Unit.find({ organizationId, status: 'AVAILABLE', deletedAt: null })
      .populate<{ propertyId: { name: string; city: string } }>('propertyId', 'name city')
      .select('name type rentAmountMinor surfaceM2 propertyId');

    const totalPotentialRentMinor = vacantUnits.reduce(
      (sum, u) => sum + (u.rentAmountMinor || 0),
      0,
    );

    return {
      vacantCount: vacantUnits.length,
      totalPotentialRentLossMinor: totalPotentialRentMinor,
      units: vacantUnits.map((u) => ({
        unitName: u.name,
        propertyName: u.propertyId?.name ?? 'Propriété',
        city: u.propertyId?.city ?? '',
        rentAmountMinor: u.rentAmountMinor,
        surfaceM2: u.surfaceM2,
      })),
    };
  },

  async getRepairExpenses(organizationId) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const rows = await Transaction.aggregate<{ total: number }>([
      {
        $match: {
          organizationId: orgObjectId,
          direction: 'EXPENSE',
          category: { $in: ['MAINTENANCE', 'REPAIR', 'RENOVATION'] },
          deletedAt: null,
          date: { $gte: startOfYear },
        },
      },
      { $group: { _id: '$category', total: { $sum: '$amountMinor' } } },
    ]);

    const totalRepairExpensesMinor = rows.reduce((sum, r) => sum + r.total, 0);

    return {
      totalRepairExpensesMinor,
      byCategory: rows.map((r) => ({ category: r._id, totalMinor: r.total })),
    };
  },

  async getLeaseExpirations(organizationId) {
    const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const rows = await Lease.find({
      organizationId,
      status: { $in: ['ACTIVE', 'EXPIRING'] },
      endDate: { $gte: new Date(), $lte: horizon },
      deletedAt: null,
    })
      .populate<{ tenantId: { fullName: string; phone?: string } }>('tenantId', 'fullName phone')
      .populate<{ unitId: { name: string } }>('unitId', 'name')
      .sort({ endDate: 1 })
      .limit(10);

    return {
      expiringCount: rows.length,
      leases: rows.map((l) => ({
        leaseNumber: l.number,
        tenantName: l.tenantId?.fullName ?? 'Locataire',
        unitName: l.unitId?.name ?? 'Logement',
        endDate: l.endDate.toISOString().slice(0, 10),
        daysRemaining: Math.ceil(
          (new Date(l.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  },

  async getMaintenanceSummary(organizationId) {
    const open = await MaintenanceTicket.countDocuments({
      organizationId,
      status: { $nin: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
      deletedAt: null,
    });
    const urgent = await MaintenanceTicket.countDocuments({
      organizationId,
      priority: 'URGENT',
      status: { $nin: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
      deletedAt: null,
    });
    return { open, urgent };
  },
};

export const AI_TOOL_NAMES = Object.keys(TOOLS);

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

/** Sélectionne les outils pertinents d'après la question posée */
function selectTools(question: string): string[] {
  const text = question.toLowerCase();
  const selected: string[] = [];

  if (text.includes('encaiss') || text.includes('loyer') || text.includes('revenu')) {
    selected.push('getRentSummary');
  }
  if (
    text.includes('impay') ||
    text.includes('retard') ||
    text.includes('payé') ||
    text.includes('dette')
  ) {
    selected.push('getOverdueRents');
  }
  if (text.includes('rentab') || text.includes('meilleur') || text.includes('profit')) {
    selected.push('getMostProfitableProperty');
  }
  if (text.includes('vacan') || text.includes('disponib') || text.includes('libre')) {
    selected.push('getVacantProperties');
  }
  if (text.includes('occup') || text.includes('logement')) {
    selected.push('getPropertyOccupancy');
  }
  if (text.includes('répar') || text.includes('dépens') || text.includes('travaux')) {
    selected.push('getRepairExpenses');
  }
  if (
    text.includes('expir') ||
    text.includes('contrat') ||
    text.includes('bail') ||
    text.includes('échéance')
  ) {
    selected.push('getLeaseExpirations');
  }
  if (text.includes('maintenance') || text.includes('panne') || text.includes('ticket')) {
    selected.push('getMaintenanceSummary');
  }

  // Par défaut si question générale
  if (selected.length === 0) {
    selected.push('getRentSummary', 'getPropertyOccupancy', 'getOverdueRents');
  }

  return Array.from(new Set(selected));
}

/** Moteur de synthèse en langage naturel DOMORA AI */
function generateNaturalAnswer(
  question: string,
  results: ToolResult[],
): { answer: string; suggestions: string[] } {
  const paragraphs: string[] = [];
  const suggestions: string[] = [];

  for (const res of results) {
    if (res.name === 'getRentSummary') {
      const data = res.data as {
        monthlyCollectedMinor: number;
        allTimeCollectedMinor: number;
        recoveryRate: number;
      };
      paragraphs.push(
        `📊 **Encaissements** : Pour le mois en cours, vous avez encaissé **${data.monthlyCollectedMinor.toLocaleString('fr-FR')} FCFA** (avec un taux de recouvrement de **${data.recoveryRate}%**). Depuis le début de vos activités sur DOMORA, vos encaissements cumulés s'élèvent à **${data.allTimeCollectedMinor.toLocaleString('fr-FR')} FCFA**.`,
      );
      if (data.recoveryRate < 80) {
        suggestions.push(
          'Le taux de recouvrement de ce mois est inférieur à 80 %. Pensez à envoyer des relances amiables par SMS ou email.',
        );
      }
    }

    if (res.name === 'getOverdueRents') {
      const data = res.data as {
        count: number;
        totalOverdueMinor: number;
        debtors: { tenantName: string; amountDueMinor: number; daysOverdue: number }[];
      };
      if (data.count === 0) {
        paragraphs.push(
          `✅ **Impayés** : Félicitations, vous n'avez aucun loyer en retard actuellement. Vos locataires sont tous à jour.`,
        );
      } else {
        const debtorLines = data.debtors
          .slice(0, 3)
          .map(
            (d) =>
              `• **${d.tenantName}** : ${d.amountDueMinor.toLocaleString('fr-FR')} FCFA (${d.daysOverdue} j de retard)`,
          )
          .join('\n');
        paragraphs.push(
          `⚠️ **Impayés constatés** : Il y a actuellement **${data.count} échéance(s) en retard**, pour un montant total d'arriérés de **${data.totalOverdueMinor.toLocaleString('fr-FR')} FCFA**.\nLocataires concernés :\n${debtorLines}`,
        );
        suggestions.push(
          'Vous pouvez générer une lettre de mise en demeure directement depuis l’onglet communications.',
        );
      }
    }

    if (res.name === 'getPropertyOccupancy') {
      const data = res.data as {
        total: number;
        occupied: number;
        available: number;
        occupancyRate: number;
      };
      paragraphs.push(
        `🏠 **Taux d'occupation** : Votre patrimoine compte **${data.total} logement(s)** au total. **${data.occupied}** sont actuellement occupés (**${data.occupancyRate}%** de taux d'occupation) et **${data.available}** sont disponibles à la location.`,
      );
      if (data.available > 0) {
        suggestions.push(
          `Vous avez ${data.available} logement(s) vacant(s). Activez la diffusion d’annonces pour minimiser la vacance locative.`,
        );
      }
    }

    if (res.name === 'getMostProfitableProperty') {
      const data = res.data as {
        topProperty?: { name: string; city: string; netProfitMinor: number };
      };
      if (data.topProperty) {
        paragraphs.push(
          `🏆 **Propriété la plus rentable** : Votre bien le plus performant est **${data.topProperty.name}** (${data.topProperty.city}) avec un bénéfice net cumulé de **${data.topProperty.netProfitMinor.toLocaleString('fr-FR')} FCFA**.`,
        );
      } else {
        paragraphs.push(
          `ℹ️ **Rentabilité** : Les données actuelles de charges et recettes sont insuffisantes pour établir un classement définitif des biens.`,
        );
      }
    }

    if (res.name === 'getVacantProperties') {
      const data = res.data as {
        vacantCount: number;
        totalPotentialRentLossMinor: number;
        units: { unitName: string; propertyName: string; rentAmountMinor: number }[];
      };
      if (data.vacantCount === 0) {
        paragraphs.push(
          `🎉 **Vacance locative** : Tous vos logements sont actuellement occupés. Aucune perte de loyer par vacance constatée.`,
        );
      } else {
        paragraphs.push(
          `🔍 **Logements vacants** : Vous avez actuellement **${data.vacantCount} logement(s) vacant(s)**, représentant un manque à gagner mensuel de **${data.totalPotentialRentLossMinor.toLocaleString('fr-FR')} FCFA**.\nExemple : ${data.units
            .slice(0, 2)
            .map(
              (u) =>
                `${u.unitName} (${u.propertyName}) à ${u.rentAmountMinor?.toLocaleString('fr-FR')} FCFA`,
            )
            .join(', ')}.`,
        );
      }
    }

    if (res.name === 'getRepairExpenses') {
      const data = res.data as { totalRepairExpensesMinor: number };
      paragraphs.push(
        `🛠️ **Dépenses en réparations & travaux** : Depuis le 1er janvier, vous avez engagé un total de **${data.totalRepairExpensesMinor.toLocaleString('fr-FR')} FCFA** en entretien, réparations et rénovation.`,
      );
    }

    if (res.name === 'getLeaseExpirations') {
      const data = res.data as {
        expiringCount: number;
        leases: { tenantName: string; unitName: string; daysRemaining: number }[];
      };
      if (data.expiringCount === 0) {
        paragraphs.push(
          `📅 **Contrats de bail** : Aucun contrat n'arrive à expiration dans les 90 prochains jours.`,
        );
      } else {
        const leaseList = data.leases
          .slice(0, 3)
          .map(
            (l) => `• **${l.tenantName}** (${l.unitName}) : expire dans ${l.daysRemaining} jour(s)`,
          )
          .join('\n');
        paragraphs.push(
          `⏳ **Baux arrivant à expiration** : **${data.expiringCount} contrat(s)** arrivent à échéance dans les 3 prochains mois :\n${leaseList}`,
        );
        suggestions.push(
          'Proposez dès maintenant un avenant de renouvellement pour sécuriser la continuité d’occupation.',
        );
      }
    }

    if (res.name === 'getMaintenanceSummary') {
      const data = res.data as { open: number; urgent: number };
      paragraphs.push(
        `🔧 **Maintenance opérationnelle** : Vous avez actuellement **${data.open} ticket(s) ouvert(s)**, dont **${data.urgent}** signalement(s) urgent(s).`,
      );
    }
  }

  const answer = paragraphs.join('\n\n');
  return { answer, suggestions };
}

/** Assistant conversationnel DOMORA AI */
export async function ask(config: AppConfig, req: Request, res: Response): Promise<void> {
  const question = String(req.body.question).trim();
  const selected = selectTools(question);
  const results: ToolResult[] = [];

  for (const name of selected) {
    const tool = TOOLS[name];
    if (tool) {
      results.push({ name, data: await tool(org(req)) });
    }
  }

  // Synthèse intelligente basée sur les données réelles
  const { answer, suggestions } = generateNaturalAnswer(question, results);

  // Journalisation de la conversation
  await AIConversation.create({
    organizationId: org(req),
    userId: req.user?.id,
    messages: [
      { role: 'user', content: question },
      { role: 'assistant', content: answer, tools: selected },
    ],
  });

  await AIUsage.create({
    organizationId: org(req),
    model: config.ai?.model || 'domora-ai-v1',
    tokens: 1,
  });

  res.locals.data = {
    answer,
    tools: results,
    suggestions,
    note: 'Analyse synthétisée fidèlement à partir des données réelles de votre organisation.',
  };
}

/** Générateur de courriers et communications types pour les locataires */
export async function draftMessage(req: Request, res: Response): Promise<void> {
  const { kind, tenantName, amount, dueDate, propertyName } = req.body as {
    kind: string;
    tenantName: string;
    amount?: string;
    dueDate?: string;
    propertyName?: string;
  };

  const templates: Record<string, string> = {
    REMINDER: `Objet : Rappel d'échéance de votre loyer - ${propertyName ?? 'Votre logement'}

Madame, Monsieur ${tenantName},

Nous vous rappelons que votre loyer d'un montant de ${amount ?? '—'} FCFA arrivera à échéance le ${dueDate ?? 'la date convenue'}.

Nous vous remercions de bien vouloir procéder à son règlement par virement ou Mobile Money avant cette date.

Restant à votre entière disposition,
La Direction DOMORA`,

    OVERDUE: `Objet : Relance pour loyer impayé - Réf #${tenantName}

Madame, Monsieur ${tenantName},

Sauf erreur de notre part, nous constatons que votre loyer d'un montant de ${amount ?? '—'} FCFA, arrivé à échéance le ${dueDate ?? 'prévu'}, n'a pas encore été crédité sur notre compte.

Nous vous prions de bien vouloir régulariser votre situation dans les plus brefs délais ou de contacter le gestionnaire en cas de difficulté passagère.

Cordialement,
Le service gestion locative`,

    FORMAL_NOTICE: `Objet : MISE EN DEMEURE DE PAYER SOUS HUIT (8) JOURS

Madame, Monsieur ${tenantName},

En dépit de nos précédents rappels, vous demeurez redevable de la somme de ${amount ?? '—'} FCFA au titre des loyers et charges pour votre logement situé à ${propertyName ?? 'notre propriété'}.

Par la présente, nous vous mettons formellement en demeure de régler ladite somme sous un délai impératif de 8 (huit) jours à compter de la réception de cette notification.

À défaut de règlement complet dans le délai imparti, nous serons contraints d'engager les poursuites judiciaires prévues par la législation en vigueur (résiliation de plein droit du bail et recouvrement forcé avec pénalités de retard).

Dans l'attente de votre règlement immédiat,
Le Cabinet de Gestion DOMORA`,

    RENEWAL_PROPOSAL: `Objet : Proposition de renouvellement de contrat de bail

Madame, Monsieur ${tenantName},

Votre bail actuel pour le logement situé à ${propertyName ?? 'notre résidence'} arrive prochainement à son terme le ${dueDate ?? 'terme convenu'}.

Nous avons le plaisir de vous proposer le renouvellement de votre bail aux conditions convenues. Si vous souhaitez reconduire votre bail, merci de nous le confirmer en retour afin d'éditer l'avenant correspondant.

Bien cordialement,
La Gestion Immobilière`,

    MAINTENANCE_UPDATE: `Objet : Prise en charge de votre demande de maintenance

Bonjour ${tenantName},

Nous vous informons que votre demande d'intervention technique a bien été enregistrée et transmise à notre artisan partenaire agréé.

Un technicien prendra contact avec vous dans les 24 heures ouvrées afin de planifier le créneau d'intervention.

Cordialement,
Le Support Technique DOMORA`,
  };

  res.locals.data = {
    draft: templates[kind] ?? templates.REMINDER,
    note: 'Brouillon prêt à être personnalisé et envoyé.',
  };
}

/** Liste des conversations IA précédentes */
export async function getConversations(req: Request, res: Response): Promise<void> {
  const conversations = await AIConversation.find({
    organizationId: org(req),
    userId: req.user?.id,
  })
    .sort({ createdAt: -1 })
    .limit(20);

  res.locals.data = conversations;
}
