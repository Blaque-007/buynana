import "./App.css";
import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Budgets from "./pages/Budgets";
import Forecast from "./pages/Forecast";
import History from "./pages/History";
import Settings from "./pages/Settings";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route
                        path="/"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/budgets"
                        element={<Budgets />}
                    />

                    <Route
                        path="/forecast"
                        element={<Forecast />}
                    />

                    <Route
                        path="/history"
                        element={<History />}
                    />

                    <Route
                        path="/settings"
                        element={<Settings />}
                    />

                    <Route path="*" element={<div role="alert"><h1>Page not found</h1><p>Choose a page from the BuyNana sidebar.</p></div>} />

                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;