import dynamic from 'next/dynamic';

const AirAwareMap = dynamic(() => import('@/components/AirAwareMap'), { ssr: false });

export default function Home() {
  return <AirAwareMap />;
}
