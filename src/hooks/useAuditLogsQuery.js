import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "../service/auditService";

export const useAuditLogsQuery = ({ page, limit, search = "" }) =>
  useQuery({
    queryKey: ["logs", page, limit, search],
    queryFn: () => getAuditLogs({ page, limit, search }),
    placeholderData: (prev) => prev, // ✅ keeps old data while fetching
  })
