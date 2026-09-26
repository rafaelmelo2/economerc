import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native";

import { palette } from "@economerc/design-tokens/native";

export interface SwitchProps extends RNSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** Switch temático — cores só via token (nunca hex solto no call site). */
export function Switch({ value, onValueChange, ...props }: SwitchProps) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: palette.grafite[300], true: palette.verde[400] }}
      thumbColor={palette.grafite[0]}
      ios_backgroundColor={palette.grafite[300]}
      {...props}
    />
  );
}
