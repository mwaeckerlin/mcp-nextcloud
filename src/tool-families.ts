import type { NextcloudOperation } from "./nextcloud-operations.js";

export interface RestToolFamily {
  name: RestToolFamilyName;
  description: string;
}

export const REST_TOOL_FAMILY_NAMES = [
  "nextcloud_webdav_rest",
  "nextcloud_caldav_rest",
  "nextcloud_carddav_rest",
  "nextcloud_ocs_users_rest",
  "nextcloud_ocs_groups_rest",
  "nextcloud_ocs_apps_rest",
  "nextcloud_ocs_shares_rest",
  "nextcloud_rest_misc"
] as const;

export type RestToolFamilyName = (typeof REST_TOOL_FAMILY_NAMES)[number];

interface RestToolFamilyMatcher {
  family: RestToolFamily;
  matches(operation: NextcloudOperation): boolean;
}

const TOOL_FAMILY_MATCHERS: RestToolFamilyMatcher[] = [
  {
    family: {
      name: "nextcloud_webdav_rest",
      description: "Nextcloud WebDAV APIs for file and directory operations: list, download, upload, move, copy, delete."
    },
    matches: (operation) => operation.tags.includes("webdav")
  },
  {
    family: {
      name: "nextcloud_caldav_rest",
      description: "Nextcloud CalDAV APIs for calendar and event operations: list calendars, get/create/delete events."
    },
    matches: (operation) => operation.tags.includes("caldav")
  },
  {
    family: {
      name: "nextcloud_carddav_rest",
      description: "Nextcloud CardDAV APIs for contacts and address book operations: list address books, get/create/delete contacts."
    },
    matches: (operation) => operation.tags.includes("carddav")
  },
  {
    family: {
      name: "nextcloud_ocs_users_rest",
      description: "Nextcloud OCS APIs for user management: list, get, create, delete, enable, and disable users."
    },
    matches: (operation) => operation.tags.includes("ocs-users")
  },
  {
    family: {
      name: "nextcloud_ocs_groups_rest",
      description: "Nextcloud OCS APIs for group management: list groups and members, create and delete groups."
    },
    matches: (operation) => operation.tags.includes("ocs-groups")
  },
  {
    family: {
      name: "nextcloud_ocs_apps_rest",
      description: "Nextcloud OCS APIs for app management: list, enable, and disable Nextcloud apps."
    },
    matches: (operation) => operation.tags.includes("ocs-apps")
  },
  {
    family: {
      name: "nextcloud_ocs_shares_rest",
      description: "Nextcloud OCS APIs for share management: list, get, create, and delete file shares."
    },
    matches: (operation) => operation.tags.includes("ocs-shares")
  },
  {
    family: {
      name: "nextcloud_rest_misc",
      description: "All remaining Nextcloud APIs not covered by the dedicated family tools."
    },
    matches: () => true
  }
];

export function classifyOperationToFamily(operation: NextcloudOperation): RestToolFamilyName {
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    if (matcher.matches(operation)) {
      return matcher.family.name;
    }
  }
  return "nextcloud_rest_misc";
}

export function getRestToolFamilies(): RestToolFamily[] {
  const dedup = new Map<RestToolFamilyName, RestToolFamily>();
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    dedup.set(matcher.family.name, matcher.family);
  }
  return [...dedup.values()];
}
