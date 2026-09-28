import type { DepartmentInput } from "./generate.js";
import { DEFAULT_SPEC, type LayoutSpec } from "./spec.js";

let departments: DepartmentInput[] = [];
let spec: LayoutSpec = DEFAULT_SPEC;

/** Called by OfficeScene before the floor mounts; the "generated" theme lays out one room per entry. */
export function setGeneratedDepartments(depts: DepartmentInput[], layoutSpec: LayoutSpec = DEFAULT_SPEC): void {
  departments = depts;
  spec = layoutSpec;
}

export function getGeneratedDepartments(): DepartmentInput[] {
  return departments;
}

export function getGeneratedSpec(): LayoutSpec {
  return spec;
}
