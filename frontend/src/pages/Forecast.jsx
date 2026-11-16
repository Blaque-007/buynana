import SavingsGoals from "../components/SavingsGoals";

function Forecast() {
    return (
        <div className="forecast-page">
            <header style={{ marginBottom: "28px" }}>
                <h1>Forecast</h1>

                <p>
                    Plan your financial future and track your savings goals.
                </p>
            </header>

            <SavingsGoals />
        </div>
    );
}

export default Forecast;