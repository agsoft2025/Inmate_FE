import { useMutation } from "@tanstack/react-query";
import { sendLowBalanceOutreach } from "../service/dashboardService";

export const useSendOutreachMutation = () =>
  useMutation({
    mutationFn: sendLowBalanceOutreach,
  });
