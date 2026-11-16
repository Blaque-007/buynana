function SummaryCard({ title, value, variant = "default" }) {
    return (
        <div className={`financial-card financial-card--${variant}`}>
            <span className="financial-card__title">
                {title}
            </span>

            <strong className="financial-card__value">
                {value}
            </strong>
        </div>
    );
}

export default SummaryCard;