import { feature, plan, item } from "atmn";

export const prompts = feature({
  id: "prompts",
  name: "Prompts",
  type: "metered",
  consumable: true,
});

// Free: 1 prompt lifetime (no reset)
export const free = plan({
  id: "free",
  name: "Free",
  autoEnable: true,
  items: [
    item({
      featureId: prompts.id,
      included: 1,
      reset: { interval: "year" },
    }),
  ],
});

// Starter: placeholder — prices/limits TBD
export const starter = plan({
  id: "starter",
  name: "Starter",
  price: { amount: 900, interval: "month" }, // $9/mo placeholder
  items: [
    item({
      featureId: prompts.id,
      included: 50,
      reset: { interval: "month" },
    }),
  ],
});

// Pro: placeholder
export const pro = plan({
  id: "pro",
  name: "Pro",
  price: { amount: 2900, interval: "month" }, // $29/mo placeholder
  items: [
    item({
      featureId: prompts.id,
      included: 200,
      reset: { interval: "month" },
    }),
  ],
});

// Agency: unlimited
export const agency = plan({
  id: "agency",
  name: "Agency",
  price: { amount: 7900, interval: "month" }, // $79/mo placeholder
  items: [
    item({
      featureId: prompts.id,
      unlimited: true,
    }),
  ],
});

export default {
  features: [prompts],
  plans: [free, starter, pro, agency],
};
