interface Props {
  name: string;
  size?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 24, style }: Props) {
  return (
    <img
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', pointerEvents: 'none', ...style }}
      alt={name}
    />
  );
}
