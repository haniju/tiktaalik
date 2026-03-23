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
      style={{ display: 'block', ...style }}
      alt={name}
    />
  );
}
