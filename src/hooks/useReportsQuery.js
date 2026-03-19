// src/hooks/useReportsQuery.js
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getStudents,
  getDepartments,
  getQuickStatistics,
  generateReport,
} from "../service/reportService";

export const useStudentsQuery = () =>
  useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

export const useDepartmentsQuery = () =>
  useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

export const useQuickStatisticsQuery = () =>
  useQuery({
    queryKey: ["quickStatistics"],
    queryFn: getQuickStatistics,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

export const useGenerateReportMutation = () =>
  useMutation({
    mutationFn: ({ url, payload, format }) => generateReport({ url, payload, format }),
  });
