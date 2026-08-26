import type { RatioSpec } from "../types";

/** Serialize ratio specs to a ratios.yaml body (client-side export). */
export function ratiosToYaml(ratios: RatioSpec[]): string {
  const lines: string[] = ["ratios:"];
  for (const ratio of ratios) {
    lines.push(`  - id: ${yamlScalar(ratio.id)}`);
    lines.push(`    name: ${yamlScalar(ratio.name)}`);
    lines.push(`    category: ${yamlScalar(ratio.category)}`);
    lines.push(`    numerator: ${yamlScalar(ratio.numerator)}`);
    if (ratio.denominator) {
      lines.push(`    denominator: ${yamlScalar(ratio.denominator)}`);
    }
    if (ratio.multiply !== undefined && ratio.multiply !== 1) {
      lines.push(`    multiply: ${ratio.multiply}`);
    }
    if (ratio.unit) {
      lines.push(`    unit: ${yamlScalar(ratio.unit)}`);
    }
    if (ratio.enabled === false) {
      lines.push("    enabled: false");
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function yamlScalar(value: string): string {
  // Quote when YAML-special characters may appear (MAR codes with /, spaces, %).
  if (/[:#{}[\],&*!|>'"%@`]/.test(value) || value.includes(" ") || value === "") {
    return JSON.stringify(value);
  }
  return value;
}

export function downloadRatiosYaml(ratios: RatioSpec[], filename = "ratios.yaml") {
  const blob = new Blob([ratiosToYaml(ratios)], {
    type: "text/yaml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function normalizeSpec(spec: Partial<RatioSpec> & Pick<RatioSpec, "id">): RatioSpec {
  return {
    id: spec.id,
    name: spec.name ?? "",
    category: spec.category ?? "overig",
    numerator: spec.numerator ?? "",
    denominator: spec.denominator || null,
    multiply: spec.multiply ?? 1,
    unit: spec.unit ?? "",
    enabled: spec.enabled !== false,
  };
}

export function blankRatioSpec(category = "overig"): RatioSpec {
  const stamp = Date.now().toString(36);
  return {
    id: `ratio_${stamp}`,
    name: "Nieuwe ratio",
    category,
    numerator: "",
    denominator: null,
    multiply: 1,
    unit: "x",
    enabled: true,
  };
}
