import { Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'semiBold' | 'subtitle' | 'link';
  className?: string;
};

function getTypeClasses(type: ThemedTextProps['type']) {
  switch (type) {
    case 'title':
      return 'text-4xl font-bold leading-8';
    case 'subtitle':
      return 'text-xl font-bold';
    case 'defaultSemiBold':
      return 'text-base leading-6 font-semibold';
    case 'semiBold':
      return 'font-semibold';
    case 'link':
      return 'text-base leading-8 text-[#0a7ea4]';
    case 'default':
    default:
      return 'text-base leading-6';
  }
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  className,
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const typeClasses = getTypeClasses(type);
  const combinedClassName = `${typeClasses} ${className || ''}`.trim();

  return (
    <Text
      className={combinedClassName}
      style={[{ color }, style]}
      {...rest}
    />
  );
}
