export type SetupPlanAction = {
  id: string;
  type: string;
  status: string;
  engine?: string;
  field?: string;
  resourceType?: string;
  name?: string;
  group?: string;
  groupCategoryId?: string;
  groupCategoryName?: string;
  groupCategorySelection?: string;
  resourceId?: string;
  resourceName?: string;
  flow?: string;
  choice?: string;
  changes?: { key: string }[];
  requiredPermissions?: string[];
  permissionStatus?: string;
  missingPermissions?: string[];
  permissionReason?: string;
  result?: { error?: string; resourceId?: string; reconciled?: boolean } | null;
};

export type SetupPlan = { id: string; digest: string; state: string; intent?: string; actions: SetupPlanAction[] };

export function summarizeSetupPlan(actions: SetupPlanAction[], completed = false) {
  const relevant = completed ? actions.filter((action) => action.status === "completed") : actions;
  const creates = relevant.filter((action) => action.type === "create_resource");
  const mappings = relevant.filter((action) => action.type === "map_existing_resource").length;
  const settings = relevant.filter((action) => action.type === "configure_protected_flow" ||
    action.changes?.some((change) => change.key !== "mode")).length;
  return {
    creates: creates.length,
    channels: creates.filter((action) => action.resourceType === "channel").length,
    categories: creates.filter((action) => action.resourceType === "category").length,
    roles: creates.filter((action) => action.resourceType === "role").length,
    mappings,
    total: creates.length + mappings + settings,
  };
}
