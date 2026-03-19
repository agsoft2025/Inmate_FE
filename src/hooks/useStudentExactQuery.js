import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStudent, deleteStudent, getStudentProfile, getStudents, getStudentTransactions, searchStudentExact, updateStudent } from "../service/studentService";

export const useStudentExactQuery = (query) =>
  useQuery({
    queryKey: ["studentExact", query],
    queryFn: () => searchStudentExact(query),
    enabled: !!query && query.length >= 3, // ✅ only when typing
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

export const useStudentsQuery = ({ search, page, limit }) =>
  useQuery({
    queryKey: ["students", search, page, limit],
    queryFn: () => getStudents({ search, page, limit }),
    placeholderData: (prev) => prev, // ✅ keeps old data while fetching (no page reset)
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

export const useCreateStudentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["students"],
      });
    },
  });
};

export const useUpdateStudentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["students"],
      });
    },
  });
};

export const useDeleteStudentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      // refresh student lists / tables
      queryClient.invalidateQueries({ queryKey: ["students"] });
      // if you have another key like ["student"], invalidate that too if needed
    },
  });
};

export function useStudentProfile(registrationNumber) {
  return useQuery({
    queryKey: ["studentProfile", registrationNumber],
    queryFn: () => getStudentProfile(registrationNumber),
    enabled: !!registrationNumber, // don't run until reg no exists
    staleTime: 60_000, // 1 minute (tune as you want)
  });
}

export function useStudentTransactions(regNo, page, limit) {
  return useQuery({
    queryKey: ["studentTransactions", regNo, page, limit],
    queryFn: () => getStudentTransactions(regNo, page, limit),
    enabled: !!regNo,
    keepPreviousData: true,
    staleTime: 30_000,
  });
}