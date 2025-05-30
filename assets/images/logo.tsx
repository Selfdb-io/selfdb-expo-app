import * as React from "react"
import Svg, { Defs, LinearGradient, Stop, Rect, Text, SvgProps } from "react-native-svg"

function SvgComponent(props: SvgProps) {
  return (
    <Svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      {...props}
    >
      <Defs>
        <LinearGradient id="a" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4F46E5" />
          <Stop offset="100%" stopColor="#7C3AED" />
        </LinearGradient>
      </Defs>
      <Rect
        x={2}
        y={2}
        width={28}
        height={28}
        rx={6}
        ry={6}
        fill="url(#a)"
        stroke="#1F2937"
        strokeWidth={0.5}
      />
      <Text
        x={16}
        y={20}
        fontFamily="Arial, sans-serif"
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
        fill="#fff"
      >
        {"OPD"}
      </Text>
    </Svg>
  )
}

export default SvgComponent
