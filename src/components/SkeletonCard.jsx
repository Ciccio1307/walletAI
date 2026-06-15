export default function SkeletonCard({ lines = 3, tall = false }) {
  return (
    <div className="skeleton-card card">
      {tall && <div className="skeleton-line tall" />}
      {!tall && Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{ width: ['85%', '60%', '75%', '45%'][i % 4] }}
        />
      ))}
    </div>
  );
}
