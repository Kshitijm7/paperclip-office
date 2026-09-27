import type { DepartmentInput } from "./generate.js";

let departments: DepartmentInput[] = [];

/** Called by OfficeScene before the floor mounts; the "generated" theme lays out one room per entry. */
export function setGeneratedDepartments(depts: DepartmentInput[]): void {
  departments = depts;
}

export function getGeneratedDepartments(): DepartmentInput[] {
  return departments;
}
