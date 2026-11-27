export type SetupPlanAction = {
  id: string;
  type: string;
  status: string;
  engine?: string;
  field?: string;
  dependencies?: string[];
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
  blueprintResource?: BlueprintResource | null;
  result?: { error?: string; resourceId?: string; reconciled?: boolean } | null;
};

export type BlueprintResource = {
  schemaVersion: number;
  logicalId: string;
  operation: string;
  template?: { id: string; version: number } | null;
  resourceType: string;
  displayName?: string;
  requiredPermissions?: string[];
  dependencies?: string[];
  configuration?: {
    discordType?: number | null;
    channelKind?: string;
    parentCategoryId?: string | null;
    parentCategoryGroup?: string;
    positionPolicy?: string;
    permissionProfile?: string;
    permissions?: string[];
    hierarchyPolicy?: string;
  };
  creationPolicy?: string;
  updatePolicy?: string;
  existingResourceMatching?: { matchedResourceId?: string | null };
  ownership?: { managedBySetup?: boolean; nameIsOwnershipEvidence?: boolean };
};

export type SetupPlan = { id: string; digest: string; state: string; intent?: string; actions: SetupPlanAction[] };

function title(value: string) {
  return value.replace(/[-_]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\b\w/g, (part) => part.toUpperCase());
}

export function describeBlueprintResource(action: SetupPlanAction, actions: SetupPlanAction[] = []): string[] {
  const blueprint = action.blueprintResource;
  if (!blueprint) return [];
  const configuration = blueprint.configuration || {};
  const details: string[] = [];

  if (blueprint.template) details.push(`Blueprint: ${title(blueprint.template.id)} v${blueprint.template.version}`);
  if (action.type === "map_existing_resource") {
    const id = blueprint.existingResourceMatching?.matchedResourceId || action.resourceId;
    details.push(`Existing ${blueprint.resourceType} ID ${id || "not available"} will be linked after guild and type checks.`);
    details.push("The linked Discord resource remains unmanaged; matching names do not establish Possum ownership.");
  } else if (blueprint.resourceType === "channel") {
    details.push(`Discord channel type: ${title(configuration.channelKind || "text")}.`);
    const categoryName = action.groupCategoryName || "";
    const categoryId = action.groupCategoryId || configuration.parentCategoryId || "";
    const categoryGroup = configuration.parentCategoryGroup || action.group || "";
    if (categoryName && categoryId) details.push(`Category: ${categoryName} (ID ${categoryId}).`);
    else if (categoryName && action.groupCategorySelection === "create") details.push(`Category: create ${categoryName} first, then place this channel in it.`);
    else if (categoryGroup) details.push(`Category group: ${title(categoryGroup)}.`);
    if (configuration.positionPolicy === "append") details.push("Order: append after existing channels in this category.");
    const access = {
      "guild-default": "Visible according to the server's existing channel permissions.",
      "everyone-denied-bot-allowed": "Private channel: @everyone is denied; the bot is allowed; the server owner retains access.",
      "vip-role-only": "Private channel: visibility is limited to the selected VIP role and the bot.",
      "rare-spawn-access-role": "Private category: visibility is limited to the configured access role and the bot.",
    }[configuration.permissionProfile || "guild-default"];
    if (access) details.push(`Access: ${access}`);
  } else if (blueprint.resourceType === "category") {
    details.push("Discord resource type: category.");
    if (configuration.positionPolicy === "append") details.push("Order: append after existing categories.");
    if (configuration.permissionProfile === "vip-role-only") details.push("Access: private to the selected VIP role and the bot.");
  } else if (blueprint.resourceType === "role") {
    const permissions = configuration.permissions || [];
    details.push(`Role permissions: ${permissions.length ? permissions.join(", ") : "none granted"}.`);
    if (configuration.hierarchyPolicy) details.push("Role hierarchy: created below the bot; existing roles are not moved.");
  }

  if (blueprint.requiredPermissions?.length) details.push(`Required bot permissions: ${blueprint.requiredPermissions.join(", ")}.`);
  const prerequisites = (blueprint.dependencies || action.dependencies || [])
    .filter((dependency) => dependency !== "apply-settings")
    .map((dependency) => actions.find((candidate) => candidate.id === dependency)?.name || dependency.replace(/^resource:/, ""));
  if (prerequisites.length) details.push(`Runs after: ${prerequisites.join(", ")}.`);
  if (blueprint.creationPolicy) details.push(`Creation policy: ${title(blueprint.creationPolicy)}.`);
  if (blueprint.updatePolicy === "preserve-existing") details.push("Existing resources and their permissions are preserved.");
  return details;
}

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
