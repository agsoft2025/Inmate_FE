import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "../service/auditService";

export const useAuditLogsQuery = ({
  page,
  limit,
  search = "",
  fromDate = "",
  toDate = "",
  userId = "",
  action = "",
}) =>
  useQuery({
    queryKey: ["logs", page, limit, search, fromDate, toDate, userId, action],
    queryFn: () => getAuditLogs({ page, limit, search, fromDate, toDate, userId, action }),
    placeholderData: (prev) => prev, // ✅ keeps old data while fetching
  })
