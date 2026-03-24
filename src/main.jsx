import { SnackbarProvider } from "notistack";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import { LocationProvider } from "./context/LocationContext";
import "./index.css";
import ReactDOM from "react-dom/client";
import { DBProvider } from "./context/DBContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <SnackbarProvider maxSnack={3} autoHideDuration={2000} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
      <BrowserRouter>
        <AuthProvider>
          <DBProvider>
            <LocationProvider>
              <App />
            </LocationProvider>
          </DBProvider>
        </AuthProvider>
      </BrowserRouter>
    </SnackbarProvider>
  </QueryClientProvider>
);
