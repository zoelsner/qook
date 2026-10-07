// Empty preferences mean unknown equipment, not an implicit stovetop-only set.
export function kitchenToolsDirective(tools: string[]): string {
  return tools.length
    ? `Available tools: ${
      tools.join(", ")
    }. Do not require anything outside this set; never replace the proposal's method to work around unavailable equipment.`
    : "Kitchen equipment is unspecified. Preserve the appliances and vessels explicitly promised by the proposal; do not assume a different equipment restriction.";
}
