import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff, ScanFace } from "lucide-react";
import { useSnackbar } from "notistack";

import { useAuth } from "../context/AuthContext";
import { useLoginMutation, useFaceLoginMutation } from "../hooks/useAuthMutation";
import logo from "../assets/logo.png";
import FaceRecognition from "../components/faceIdComponent/FaceID";

const getRedirectPath = (role) => {
  const r = String(role || "").toUpperCase();

  switch (r) {
    case "SUPER ADMIN":
      return "/super-dashboard";
    case "ADMIN":
      return "/dashboard";
    case "POS":
      return "/tuck-shop-pos";
    case "INMATE":
      return "/inmate-profile";
    default:
      return "/login";
  }
};

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.data?.message ||
  err?.message ||
  "Something went wrong";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const loginMutation = useLoginMutation();
  const faceLoginMutation = useFaceLoginMutation();

  const [showPassword, setShowPassword] = useState(false);
  const [openFaceId, setOpenFaceId] = useState(false);
  const [faceidData, setFaceIdData] = useState(null);

  const schema = useMemo(
    () =>
      yup.object({
        username: yup.string().required("Username is required"),
        password: yup
          .string()
          .required("Password is required")
          .min(4, "Password must be at least 4 characters"),
      }),
    []
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const handleAuthSuccess = useCallback(
    (data) => {
      // Your AuthContext login should store token/user/role etc.
      login(data);

      const role = data?.user?.role;
      navigate(getRedirectPath(role), { replace: true });
    },
    [enqueueSnackbar, login, navigate]
  );

  // ✅ Password login
  const onSubmit = (values) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        enqueueSnackbar("Login successful", { variant: "success" });
        handleAuthSuccess(data);
      },
      onError: (err) => {
        enqueueSnackbar(err?.response?.data?.message || "Invalid credentials", {
          variant: "error",
        });
      },
    });
  };

  // ✅ FaceID login trigger (replaces your old axios effect)
  useEffect(() => {
    if (!faceidData) return;

    const run = async () => {
      try {
        const data = await faceLoginMutation.mutateAsync(faceidData);
        handleAuthSuccess(data);
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: "error" });
      } finally {
        // important so it doesn't auto-retry on re-render
        setFaceIdData(null);
        setOpenFaceId(false);
      }
    };

    run();
  }, [faceidData]);

  const loading = loginMutation.isPending || faceLoginMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md"
      >
        <img src={logo} alt="logo" className="p-4" />
        <h1 className="text-3xl font-bold text-primary mb-6 text-center">
          Inmate Management
        </h1>

        {/* Username */}
        <label className="block text-sm font-medium mb-2">Username</label>
        <input
          className={`w-full border rounded-lg p-3 mb-2 outline-none focus:ring-2 focus:ring-primary ${
            errors.username ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter username"
          {...register("username")}
        />
        {errors.username && (
          <p className="text-red-600 text-sm mb-3">{errors.username.message}</p>
        )}

        {/* Password */}
        <label className="block text-sm font-medium mb-2">Password</label>
        <div
          className={`w-full border rounded-lg p-3 mb-2 flex items-center gap-2 ${
            errors.password ? "border-red-500" : "border-gray-300"
          }`}
        >
          <input
            className="w-full outline-none bg-transparent"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-gray-600 hover:text-gray-900"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-600 text-sm mb-4">{errors.password.message}</p>
        )}

        {/* Login */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg p-3 mt-3 bg-primary text-white font-semibold disabled:opacity-70"
        >
          {loginMutation.isPending ? "Logging in..." : "Login"}
        </button>

        {/* FaceID */}
        <button
          type="button"
          onClick={() => setOpenFaceId(true)}
          disabled={loading}
          className="w-full rounded-lg p-3 mt-3 bg-gray-700 text-white font-semibold disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <ScanFace size={18} />
          {faceLoginMutation.isPending ? "Scanning..." : "Login with Face ID"}
        </button>
      </form>

      {openFaceId && (
        <FaceRecognition
          mode="match"
          open={openFaceId}
          setOpen={setOpenFaceId}
          setFaceIdData={setFaceIdData}
        />
      )}
    </div>
  );
}
