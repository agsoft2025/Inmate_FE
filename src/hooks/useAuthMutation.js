import { useMutation } from "@tanstack/react-query";
import { loginService } from "../service/authService";
import api from "../lib/axios";

export const useLoginMutation = () =>
  useMutation({
    mutationFn: loginService,
  });

  export const useFaceLoginMutation = () =>
  useMutation({
    mutationFn: async (descriptor) => {
      const res = await api.post(
        `user/login`,
        { descriptor }
      );
      return res.data; // <-- return data directly
    },
  });