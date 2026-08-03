export default function RunnerEmpty({ message }: { message: string }) {
  return (
    <div className="runner-empty" role="status">
      <img
        className="runner-empty-art"
        src="/undraw-jogging.svg"
        width="899"
        height="635"
        alt=""
        aria-hidden="true"
      />
      <p>{message}</p>
    </div>
  );
}
