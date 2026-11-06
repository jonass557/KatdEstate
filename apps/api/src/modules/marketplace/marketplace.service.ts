import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import { sendSuccess } from '../../common/http.js';
import { Listing, Lead, Viewing, Offer, AgentProfile } from '../../models/marketplace.js';

export async function searchListings(req: Request, res: Response): Promise<void> {
  const {
    q,
    city,
    district,
    category,
    propertyType,
    transactionType,
    minPrice,
    maxPrice,
    minSurface,
    maxSurface,
    bedrooms,
    isTitled,
    isVerified,
    isFeatured,
    sortBy = 'newest',
    page = '1',
    limit = '12',
  } = req.query;

  const filter: Record<string, unknown> = {
    status: 'PUBLISHED',
    deletedAt: null,
  };

  if (q && typeof q === 'string' && q.trim()) {
    const regex = new RegExp(q.trim(), 'i');
    filter.$or = [
      { title: regex },
      { description: regex },
      { 'location.city': regex },
      { 'location.district': regex },
    ];
  }

  if (city && typeof city === 'string' && city.trim()) {
    filter['location.city'] = new RegExp(`^${city.trim()}$`, 'i');
  }

  if (district && typeof district === 'string' && district.trim()) {
    filter['location.district'] = new RegExp(district.trim(), 'i');
  }

  if (category && typeof category === 'string') {
    filter.category = category;
  }

  if (propertyType && typeof propertyType === 'string') {
    filter.propertyType = propertyType;
  }

  if (transactionType && typeof transactionType === 'string') {
    filter.transactionType = transactionType;
  }

  if (minPrice || maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (minPrice) priceFilter.$gte = Number(minPrice);
    if (maxPrice) priceFilter.$lte = Number(maxPrice);
    filter.priceMinor = priceFilter;
  }

  if (minSurface || maxSurface) {
    const surfaceFilter: Record<string, number> = {};
    if (minSurface) surfaceFilter.$gte = Number(minSurface);
    if (maxSurface) surfaceFilter.$lte = Number(maxSurface);
    filter.surfaceM2 = surfaceFilter;
  }

  if (bedrooms) {
    filter.bedrooms = { $gte: Number(bedrooms) };
  }

  if (isTitled !== undefined) {
    filter.isTitled = isTitled === 'true' || isTitled === true;
  }

  if (isVerified !== undefined) {
    filter.isVerified = isVerified === 'true' || isVerified === true;
  }

  if (isFeatured !== undefined) {
    filter.isFeatured = isFeatured === 'true' || isFeatured === true;
  }

  let sortOption: Record<string, 1 | -1> = { isFeatured: -1, createdAt: -1 };
  if (sortBy === 'priceAsc') sortOption = { priceMinor: 1 };
  else if (sortBy === 'priceDesc') sortOption = { priceMinor: -1 };
  else if (sortBy === 'surfaceDesc') sortOption = { surfaceM2: -1 };
  else if (sortBy === 'newest') sortOption = { isFeatured: -1, createdAt: -1 };

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 12));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Listing.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate(
        'agentProfileId',
        'firstName lastName phone email agencyName photoUrl rating verificationStatus',
      )
      .lean(),
    Listing.countDocuments(filter),
  ]);

  // Clean exact address if hideExactAddress is true
  const sanitizedItems = items.map((item) => {
    if (item.location?.hideExactAddress) {
      return {
        ...item,
        location: {
          ...item.location,
          address: undefined,
        },
      };
    }
    return item;
  });

  res.locals.data = {
    items: sanitizedItems,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

export async function getListingById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const listing = await Listing.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
    .populate('agentProfileId')
    .populate('publisherId', 'name email phone')
    .populate('propertyId', 'name type address')
    .populate('unitId', 'unitNumber type rentAmountMinor')
    .lean();

  if (!listing || listing.deletedAt) {
    throw new HttpError(404, 'Annonce immobilière introuvable ou retirée.');
  }

  // Address sanitization if hidden
  if (listing.location?.hideExactAddress) {
    listing.location.address = undefined as any;
  }

  res.locals.data = listing;
}

export async function submitInquiry(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { fullName, phone, email, message } = req.body;

  const listing = await Listing.findById(id);
  if (!listing || listing.deletedAt) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  listing.inquiriesCount = (listing.inquiriesCount || 0) + 1;
  await listing.save();

  // If the listing belongs to an agent, create a lead in CRM
  if (listing.agentProfileId || listing.publisherRole === 'AGENT') {
    const agentId = listing.publisherId;
    await Lead.create({
      organizationId: listing.organizationId,
      agentId,
      fullName,
      phone,
      email,
      searchType: listing.transactionType === 'SALE' ? 'BUY' : 'RENT',
      budgetMinor: listing.priceMinor,
      currency: listing.currency,
      targetCity: listing.location.city,
      targetDistrict: listing.location.district,
      targetPropertyType: listing.propertyType,
      status: 'NEW',
      associatedListings: [listing._id],
      notes: `Demande de renseignement pour l'annonce : "${listing.title}". Message: ${message || 'Aucun message.'}`,
    });
  }

  res.locals.data = {
    message: 'Votre demande a bien été transmise. Le responsable vous recontactera rapidement.',
  };
}

export async function schedulePublicViewing(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { prospectName, prospectPhone, prospectEmail, date, notes } = req.body;

  const listing = await Listing.findById(id);
  if (!listing || listing.deletedAt) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  const viewing = await Viewing.create({
    organizationId: listing.organizationId,
    listingId: listing._id,
    agentId: listing.publisherRole === 'AGENT' ? listing.publisherId : undefined,
    ownerId: listing.publisherRole === 'OWNER' ? listing.publisherId : undefined,
    prospectName,
    prospectPhone,
    prospectEmail,
    date: new Date(date),
    status: 'SCHEDULED',
    notes,
  });

  // If lead CRM applies
  if (listing.publisherRole === 'AGENT') {
    await Lead.create({
      organizationId: listing.organizationId,
      agentId: listing.publisherId,
      fullName: prospectName,
      phone: prospectPhone,
      email: prospectEmail,
      searchType: listing.transactionType === 'SALE' ? 'BUY' : 'RENT',
      budgetMinor: listing.priceMinor,
      currency: listing.currency,
      targetCity: listing.location.city,
      status: 'CONTACTED',
      associatedListings: [listing._id],
      notes: `Visite programmée pour le ${new Date(date).toLocaleString('fr-FR')}. Notes: ${notes || 'Aucune.'}`,
    });
  }

  res.locals.data = {
    viewing,
    message: 'Votre demande de visite a bien été enregistrée.',
  };
}

export async function submitPublicOffer(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { prospectName, prospectPhone, prospectEmail, offeredAmountMinor, message } = req.body;

  const listing = await Listing.findById(id);
  if (!listing || listing.deletedAt) {
    throw new HttpError(404, 'Annonce introuvable.');
  }

  const offer = await Offer.create({
    organizationId: listing.organizationId,
    listingId: listing._id,
    agentId: listing.publisherRole === 'AGENT' ? listing.publisherId : undefined,
    ownerId: listing.publisherRole === 'OWNER' ? listing.publisherId : undefined,
    prospectName,
    prospectPhone,
    prospectEmail,
    offeredAmountMinor,
    currency: listing.currency,
    status: 'SUBMITTED',
    message,
  });

  res.locals.data = {
    offer,
    message: 'Votre proposition a bien été soumise au propriétaire / gestionnaire.',
  };
}
