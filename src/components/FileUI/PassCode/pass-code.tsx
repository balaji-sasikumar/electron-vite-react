import React, { useEffect, useState } from "react";
import OtpInput from "react-otp-input";

interface Props {
  setShowPassCode: (showPassCode: boolean) => void;
  showSnackBar: (severity: any, message: string) => void;
}
const PassCodeComponent: React.FC<Props> = ({
  setShowPassCode,
  showSnackBar,
}) => {
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    if (passcode.length === 6) {
      if (passcode === "123456") {
        setShowPassCode(false);
        localStorage.setItem("showConfig", "true");
      } else if (passcode === "000000") {
        localStorage.clear();
        localStorage.setItem("showConfig", "false");
        setShowPassCode(false);
      } else {
        setPasscode("");
        showSnackBar("error", "Invalid Passcode. Please try again.");
        const input = document.querySelector("input");
        if (input) {
          input.focus();
        }
      }
    }
  }, [passcode]);

  return (
    <OtpInput
      value={passcode}
      onChange={setPasscode}
      numInputs={6}
      renderSeparator={<span>&nbsp;-&nbsp;</span>}
      renderInput={(props) => <input {...props} />}
      inputStyle={
        "!w-8 h-8 text-center text-2xl font-semibold rounded-md border border-gray-600 focus:outline-none focus:border-blue-700"
      }
      containerStyle={"flex justify-center items-center h-full"}
      shouldAutoFocus
      inputType="password"
    />
  );
};

export default PassCodeComponent;
