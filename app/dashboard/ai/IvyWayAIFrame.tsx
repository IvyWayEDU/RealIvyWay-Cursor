'use client';

export default function IvyWayAIFrame({
  src,
}: {
  src: string;
}) {
  return (
    <iframe
      title="IvyWay AI"
      src={src}
      className="block h-full w-full flex-1"
      style={{ border: 0 }}
      referrerPolicy="no-referrer"
    />
  );
}

