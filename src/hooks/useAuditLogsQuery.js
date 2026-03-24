import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "../service/auditService";

export const useAuditLogsQuery = ({ page, limit }) =>
  useQuery({
    queryKey: ["logs", page, limit],
    queryFn: () => getAuditLogs({ page, limit }),
    placeholderData: (prev) => prev, // ✅ keeps old data while fetching
  })