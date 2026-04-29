export interface NextcloudOperation {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PROPFIND" | "MKCOL" | "MOVE" | "COPY" | "REPORT" | "HEAD";
  path: string;
  tags: string[];
  parameterNames: string[];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function op(
  operationId: string,
  method: NextcloudOperation["method"],
  path: string,
  tags: string[],
  parameterNames: string[] = []
): NextcloudOperation {
  return { operationId, method, path, tags: uniqueSorted(tags), parameterNames: uniqueSorted(parameterNames) };
}

// ─── Operations ───────────────────────────────────────────────────────────────

const OPERATIONS: NextcloudOperation[] = [
  // WebDAV file operations
  op("webdav.directory.create", "MKCOL", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["path"]),
  op("webdav.directory.list", "PROPFIND", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["path"]),
  op("webdav.file.copy", "COPY", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["destination", "path"]),
  op("webdav.file.delete", "DELETE", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["path"]),
  op("webdav.file.download", "GET", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["path"]),
  op("webdav.file.move", "MOVE", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["destination", "path"]),
  op("webdav.file.upload", "PUT", "/remote.php/dav/files/{username}/{path}", ["webdav"], ["body", "path"]),

  // CalDAV calendar operations
  op("caldav.calendars.list", "PROPFIND", "/remote.php/dav/calendars/{username}/", ["caldav"], []),
  op("caldav.event.create", "PUT", "/remote.php/dav/calendars/{username}/{calendar}/{uid}.ics", ["caldav"], ["body", "calendar", "uid"]),
  op("caldav.event.delete", "DELETE", "/remote.php/dav/calendars/{username}/{calendar}/{uid}.ics", ["caldav"], ["calendar", "uid"]),
  op("caldav.event.get", "GET", "/remote.php/dav/calendars/{username}/{calendar}/{uid}.ics", ["caldav"], ["calendar", "uid"]),
  op("caldav.events.list", "REPORT", "/remote.php/dav/calendars/{username}/{calendar}/", ["caldav"], ["calendar", "end", "start"]),

  // CardDAV contacts operations
  op("carddav.addressbooks.list", "PROPFIND", "/remote.php/dav/addressbooks/users/{username}/", ["carddav"], []),
  op("carddav.contact.create", "PUT", "/remote.php/dav/addressbooks/users/{username}/{book}/{uid}.vcf", ["carddav"], ["body", "book", "uid"]),
  op("carddav.contact.delete", "DELETE", "/remote.php/dav/addressbooks/users/{username}/{book}/{uid}.vcf", ["carddav"], ["book", "uid"]),
  op("carddav.contact.get", "GET", "/remote.php/dav/addressbooks/users/{username}/{book}/{uid}.vcf", ["carddav"], ["book", "uid"]),
  op("carddav.contacts.list", "REPORT", "/remote.php/dav/addressbooks/users/{username}/{book}/", ["carddav"], ["book"]),

  // OCS user management
  op("ocs.user.create", "POST", "/ocs/v2.php/cloud/users", ["ocs-users"], ["displayName", "email", "groups", "password", "quota", "userid"]),
  op("ocs.user.delete", "DELETE", "/ocs/v2.php/cloud/users/{userId}", ["ocs-users"], ["userId"]),
  op("ocs.user.disable", "PUT", "/ocs/v2.php/cloud/users/{userId}/disable", ["ocs-users"], ["userId"]),
  op("ocs.user.enable", "PUT", "/ocs/v2.php/cloud/users/{userId}/enable", ["ocs-users"], ["userId"]),
  op("ocs.user.get", "GET", "/ocs/v2.php/cloud/users/{userId}", ["ocs-users"], ["userId"]),
  op("ocs.users.list", "GET", "/ocs/v2.php/cloud/users", ["ocs-users"], ["limit", "offset", "search"]),

  // OCS group management
  op("ocs.group.create", "POST", "/ocs/v2.php/cloud/groups", ["ocs-groups"], ["groupid"]),
  op("ocs.group.delete", "DELETE", "/ocs/v2.php/cloud/groups/{groupId}", ["ocs-groups"], ["groupId"]),
  op("ocs.group.users.list", "GET", "/ocs/v2.php/cloud/groups/{groupId}/users", ["ocs-groups"], ["groupId"]),
  op("ocs.groups.list", "GET", "/ocs/v2.php/cloud/groups", ["ocs-groups"], ["limit", "offset", "search"]),

  // OCS app management
  op("ocs.app.disable", "DELETE", "/ocs/v2.php/cloud/apps/{appId}", ["ocs-apps"], ["appId"]),
  op("ocs.app.enable", "POST", "/ocs/v2.php/cloud/apps/{appId}", ["ocs-apps"], ["appId"]),
  op("ocs.apps.list", "GET", "/ocs/v2.php/cloud/apps", ["ocs-apps"], ["filter"]),

  // OCS shares
  op("ocs.share.delete", "DELETE", "/ocs/v2.php/apps/files_sharing/api/v1/shares/{shareId}", ["ocs-shares"], ["shareId"]),
  op("ocs.share.get", "GET", "/ocs/v2.php/apps/files_sharing/api/v1/shares/{shareId}", ["ocs-shares"], ["shareId"]),
  op("ocs.shares.create", "POST", "/ocs/v2.php/apps/files_sharing/api/v1/shares", ["ocs-shares"], ["password", "path", "permissions", "publicUpload", "reshares", "shareType", "shareWith"]),
  op("ocs.shares.list", "GET", "/ocs/v2.php/apps/files_sharing/api/v1/shares", ["ocs-shares"], ["path", "reshares", "shared_with_me", "subfiles"]),

  // OCS capabilities
  op("ocs.capabilities.get", "GET", "/ocs/v2.php/cloud/capabilities", ["ocs-capabilities"], [])
];

// Keep sorted for deterministic output
const SORTED_OPERATIONS = [...OPERATIONS].sort((a, b) => a.operationId.localeCompare(b.operationId));

export function loadNextcloudOperations(): NextcloudOperation[] {
  return SORTED_OPERATIONS;
}
