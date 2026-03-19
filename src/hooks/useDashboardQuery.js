import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "../service/dashboardService";

export const useDashboardQuery = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
