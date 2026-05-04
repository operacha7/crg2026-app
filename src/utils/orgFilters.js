// Helpers for parent/subgroup dropdown population and directory filtering.
// Subgroups (e.g., SVdP districts) are stored in directory.subgroup and presented
// as parent-equivalent filter values, visually nested under their parent.

// Build the parent dropdown options as [{value, label}, ...].
// Parents appear alphabetically; their subgroups (if any) follow immediately,
// sorted by trailing number when present, with a "— " indent prefix on the label.
// Parents and subgroups with only a single child are excluded as redundant.
//
// Accepts records with at least { organization, org_parent, subgroup }.
export function buildParentDropdownOptions(records) {
  const parentChildren = new Map();   // parent -> Set of child org names
  const parentSubgroups = new Map();  // parent -> Map<subgroup, Set of child org names>

  records.forEach((r) => {
    if (!r || !r.org_parent || !r.organization) return;
    if (!parentChildren.has(r.org_parent)) parentChildren.set(r.org_parent, new Set());
    parentChildren.get(r.org_parent).add(r.organization);

    if (r.subgroup) {
      if (!parentSubgroups.has(r.org_parent)) parentSubgroups.set(r.org_parent, new Map());
      const subMap = parentSubgroups.get(r.org_parent);
      if (!subMap.has(r.subgroup)) subMap.set(r.subgroup, new Set());
      subMap.get(r.subgroup).add(r.organization);
    }
  });

  const parents = [...parentChildren.entries()]
    .filter(([, kids]) => kids.size > 1)
    .map(([p]) => p)
    .sort((a, b) => a.localeCompare(b));

  const options = [];
  parents.forEach((parent) => {
    options.push({ value: parent, label: parent });

    const subMap = parentSubgroups.get(parent);
    if (!subMap) return;
    const subs = [...subMap.entries()]
      .filter(([, kids]) => kids.size > 1)
      .map(([sg]) => sg)
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+$/)?.[0] ?? "", 10);
        const numB = parseInt(b.match(/\d+$/)?.[0] ?? "", 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });
    // `parent` lets the dropdown's search include a parent's subgroups when
    // the parent name matches (e.g., typing "Society" surfaces the SVdP districts).
    subs.forEach((sg) => options.push({ value: sg, label: `— ${sg}`, parent }));
  });

  return options;
}

// True if the record matches the selected parent value, treating subgroup
// values as parent-equivalents.
export function matchesParentOrSubgroup(record, selected) {
  if (!selected || !record) return true;
  return record.org_parent === selected || record.subgroup === selected;
}
