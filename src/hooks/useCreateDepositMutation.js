import { useMutation } from "@tanstack/react-query";
import { createDeposit } from "../service/financialService";

export const useCreateDepositMutation = () =>
  useMutation({
    mutationFn: createDeposit,
  });
