// src/index.ts
import z from "@deepseek-ai/schemastery";

// src/preferences.ts
var LAYOUTS = ["reader", "cards", "process", "checklist"];
var LEGACY_LAYOUTS = ["timeline", "split", "compact"];
var MOTIONS = ["smooth", "fade"];
var DENSITIES = ["comfortable", "tight"];
var TEXT_SIZES = ["standard", "large"];
var DEFAULTS = { layout: "reader", motion: "fade", density: "comfortable", textSize: "standard" };

// src/index.ts
var Config = z.object({
  layout: z.union([...LAYOUTS, ...LEGACY_LAYOUTS]).default(DEFAULTS.layout).volatile(),
  motion: z.union([...MOTIONS]).default(DEFAULTS.motion).volatile(),
  density: z.union([...DENSITIES]).default(DEFAULTS.density).volatile(),
  textSize: z.union([...TEXT_SIZES]).default(DEFAULTS.textSize).volatile()
});
function apply(ctx) {
  ctx.inject(["settings"], (scope) => {
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber));
  });
}
export {
  Config,
  apply
};
