import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import TransactionTest from "./pages/TransactionTest";
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
                        element={<TransactionTest />}
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

                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;