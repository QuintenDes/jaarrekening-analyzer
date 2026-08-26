import type { RatioSpec } from "../types";
import { ratioIdFromName } from "./ratioId";

/** Serialize ratio specs to a ratios.yaml body (client-side export). */
export function ratiosToYaml(
  ratios: RatioSpec[],
  extras?: {
    dashboard_ratio_count?: number;
    categories?: string[];
    dashboard_key_ids?: Record<string, string[]>;
  },
): string {
  const lines: string[] = [];
  if (extras?.dashboard_ratio_count) {
    lines.push(`dashboard_ratio_count: ${extras.dashboard_ratio_count}`);
  }
  if (extras?.categories && extras.categories.length > 0) {
    lines.push("categories:");
    for (const category of extras.categories) {
      lines.push(`  - ${yamlScalar(category)}`);
    }
  }
  if (extras?.dashboard_key_ids && Object.keys(extras.dashboard_key_ids).length > 0) {
    lines.push("dashboard_key_ids:");
    for (const [category, ids] of Object.entries(extras.dashboard_key_ids)) {
      lines.push(`  ${yamlScalar(category)}:`);
      for (const id of ids) {
        lines.push(`    - ${yamlScalar(id)}`);
      }
    }
  }
  if (lines.length > 0) lines.push("");
  lines.push("ratios:");
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

export function downloadRatiosYaml(
  ratios: RatioSpec[],
  filename = "ratios.yaml",
  extras?: {
    dashboard_ratio_count?: number;
    categories?: string[];
    dashboard_key_ids?: Record<string, string[]>;
  },
) {
  const blob = new Blob([ratiosToYaml(ratios, extras)], {
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

export function blankRatioSpec(
  category = "overig",
  takenIds: Iterable<string> = [],
): RatioSpec {
  const name = "Nieuwe ratio";
  return {
    id: ratioIdFromName(name, takenIds),
    name,
    category,
    numerator: "",
    denominator: null,
    multiply: 1,
    unit: "x",
    enabled: true,
  };
}
