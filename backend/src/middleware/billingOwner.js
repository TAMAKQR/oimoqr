export const requireBillingOwner = (req, res, next) => {
  if (!req.user?.restaurants?.length) {
    return res.status(403).json({
      error: 'Управлять подпиской может только владелец бизнеса',
      code: 'BILLING_OWNER_REQUIRED',
    });
  }

  next();
};
