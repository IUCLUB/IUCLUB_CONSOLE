import LogRows from "../components/LogRows.jsx";

export default function Activity({ data }) {
  return (
    <section className="card">
      <LogRows log={data.log} withProject={false} />
    </section>
  );
}
