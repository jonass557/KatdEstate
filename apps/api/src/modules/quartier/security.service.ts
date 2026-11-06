import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import { IncidentReport, EmergencyContact } from '../../models/quartier.js';

// Générateur de numéro d'incident unique
async function generateIncidentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await IncidentReport.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) },
  });
  const serial = String(count + 1).padStart(4, '0');
  return `INC-${year}-${serial}`;
}

export async function reportIncident(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const body = req.body;

  const incidentNumber = await generateIncidentNumber();

  const incident = await IncidentReport.create({
    incidentNumber,
    category: body.category,
    description: body.description,
    severity: body.severity || 'MEDIUM',
    neighborhoodId: body.neighborhoodId,
    blockId: body.blockId,
    locationText: body.locationText,
    photoUrl: body.photoUrl,
    isAnonymous: Boolean(body.isAnonymous),
    reporterId: userId,
    reporterName: body.reporterName || (body.isAnonymous ? 'Anonyme' : undefined),
    reporterPhone: body.reporterPhone,
    status: 'NEW',
  });

  res.locals.data = {
    incident,
    message:
      'Votre signalement a été enregistré de façon confidentielle et transmis aux responsables de votre secteur.',
  };
}

export async function listIncidents(req: Request, res: Response): Promise<void> {
  const userRole = req.user?.role;
  const { neighborhoodId, blockId, category, status, severity } = req.query;

  const filter: Record<string, unknown> = {};
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (blockId) filter.blockId = blockId;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  const incidents = await IncidentReport.find(filter)
    .sort({ createdAt: -1 })
    .populate('neighborhoodId', 'name')
    .populate('blockId', 'name code')
    .lean();

  // Confidentialité : pour les résidents ordinaires, anonymiser le déclarant
  const isLeaderOrAdmin =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'ADMIN' ||
    userRole === 'NEIGHBORHOOD_LEADER' ||
    userRole === 'BLOCK_LEADER';

  const sanitized = incidents.map((item) => {
    if (!isLeaderOrAdmin || item.isAnonymous) {
      return {
        ...item,
        reporterName: 'Habitant du secteur (Confidentiel)',
        reporterPhone: undefined,
        reporterId: undefined,
      };
    }
    return item;
  });

  res.locals.data = sanitized;
}

export async function updateIncidentStatus(req: Request, res: Response): Promise<void> {
  const leaderId = req.user!.id;
  const { id } = req.params;
  const { status, resolutionNotes } = req.body;

  const incident = await IncidentReport.findById(id);
  if (!incident) {
    throw new HttpError(404, 'Signalement introuvable.');
  }

  incident.status = status;
  if (resolutionNotes) incident.resolutionNotes = resolutionNotes;
  incident.handledBy = leaderId;
  incident.handledAt = new Date();
  await incident.save();

  res.locals.data = { incident, message: 'Statut du signalement mis à jour.' };
}

// --- Annuaire d'Urgence Local ---

export async function listEmergencyContacts(req: Request, res: Response): Promise<void> {
  const { neighborhoodId, cityId } = req.query;
  const filter: Record<string, unknown> = {};

  if (neighborhoodId) filter.$or = [{ neighborhoodId }, { neighborhoodId: null }];
  else if (cityId) filter.$or = [{ cityId }, { cityId: null }];

  let contacts = await EmergencyContact.find(filter).sort({ name: 1 }).lean();

  // Si aucun contact configuré, fournir la liste standard ouest-africaine par défaut
  if (contacts.length === 0) {
    contacts = [
      {
        name: 'Sapeurs-Pompiers',
        serviceType: 'Secours & Incendie',
        phone: '18',
        shortNumber: '18',
      },
      { name: 'Police Secours', serviceType: 'Sécurité Publique', phone: '17', shortNumber: '17' },
      {
        name: 'Gendarmerie Nationale',
        serviceType: 'Sécurité & Ordre',
        phone: '800 00 20 20',
        shortNumber: '123',
      },
      { name: 'SAMU National', serviceType: 'Urgences Médicales', phone: '15', shortNumber: '15' },
      {
        name: 'Dépannage Eau',
        serviceType: 'Réseau Eau Potable',
        phone: '800 00 11 11',
        shortNumber: '',
      },
      {
        name: 'Dépannage Électricité',
        serviceType: 'Réseau Électrique',
        phone: '33 867 44 44',
        shortNumber: '',
      },
    ] as any;
  }

  res.locals.data = contacts;
}

export async function createEmergencyContact(req: Request, res: Response): Promise<void> {
  const contact = await EmergencyContact.create(req.body);
  res.locals.data = contact;
}
