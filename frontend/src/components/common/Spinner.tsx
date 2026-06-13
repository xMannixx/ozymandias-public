function Spinner(): JSX.Element {
  return (
    <span
      aria-label="loading"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-blue-400"
    />
  );
}

export default Spinner;
