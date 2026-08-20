/**
 * Business rules, ported from the Next.js version's goal-domain.ts.
 */

var MIN_KRAS = 2;
var MAX_KRAS = 5;
var MAX_KPIS_PER_KRA = 3;
var KRA_WEIGHT_TOTAL = 100;

function validateKras_(kras) {
  var errors = [];

  if (kras.length < MIN_KRAS || kras.length > MAX_KRAS) {
    errors.push(
      "You must have between " + MIN_KRAS + " and " + MAX_KRAS + " KRAs (currently " + kras.length + ")."
    );
  }

  var weightSum = kras.reduce(function (sum, k) {
    var w = Number(k.weight);
    return sum + (isFinite(w) ? w : 0);
  }, 0);
  if (weightSum !== KRA_WEIGHT_TOTAL) {
    errors.push("KRA weights must sum to " + KRA_WEIGHT_TOTAL + "% (currently " + weightSum + "%).");
  }

  kras.forEach(function (kra, i) {
    if (!str_(kra.title).trim()) {
      errors.push("KRA #" + (i + 1) + " needs a title.");
    }
    if (kra.weight <= 0 || kra.weight > 100) {
      errors.push("KRA #" + (i + 1) + " weight must be between 1 and 100.");
    }
    if (kra.kpis.length > MAX_KPIS_PER_KRA) {
      errors.push("KRA #" + (i + 1) + " has more than " + MAX_KPIS_PER_KRA + " KPIs.");
    }
  });

  return errors;
}
