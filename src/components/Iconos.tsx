import Svg, { Line, Path, Rect } from 'react-native-svg';

/** Caja de cartón con la cinta al medio */
export function IconoCaja({ size = 24, color = '#B27A42' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8.5 12 4l9 4.5v9L12 22l-9-4.5v-9Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M3 8.5 12 13l9-4.5M12 13v9" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="m7.5 6.25 9 4.5" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
    </Svg>
  );
}

/** Cajón de madera con listones */
export function IconoCajon({ size = 24, color = '#6E7D3A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={15} rx={1.5} stroke={color} strokeWidth={1.8} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={1.6} />
      <Line x1={3} y1={15} x2={21} y2={15} stroke={color} strokeWidth={1.6} />
      <Line x1={4} y1={19} x2={20} y2={6} stroke={color} strokeWidth={1.6} opacity={0.6} />
    </Svg>
  );
}
