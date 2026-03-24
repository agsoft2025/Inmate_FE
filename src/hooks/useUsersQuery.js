import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteFaceRecognition, deleteUser, getUserById, getUsers, updateUser } from "../service/userService";

export const useUsersQuery = ({ page, limit }) =>
  useQuery({
    queryKey: ["users", page, limit],
    queryFn: () => getUsers({ page, limit }),
    placeholderData: (prev) => prev, // keeps table stable
    staleTime: 1000 * 10,
    refetchOnWindowFocus: false,
  });

  export const useUserMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) =>
      id ? updateUser({ id, payload }) : createUser(payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

  export const useDeleteUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,

    onSuccess: () => {
      // 🔥 refresh users list automatically
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export function useDeleteFaceRecognitionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFaceRecognition,

    onSuccess: () => {
      // refresh any related face lists
      queryClient.invalidateQueries({
        queryKey: ["faceRecognition"],
      });
    },
  });
}

export function useUserByIdQuery(id) {
  return useQuery({
    queryKey: ["userById", id],
    queryFn: () => getUserById(id),
    enabled: !!id,          // ✅ runs only when id exists
    staleTime: 60_000,
  });
}