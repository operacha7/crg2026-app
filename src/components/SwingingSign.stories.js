import React from "react";
import SwingingSign from "./SwingingSign";

export default {
  title: "Components/SwingingSign",
  component: SwingingSign,
};

const Template = (args) => <SwingingSign {...args} />;

export const Default = Template.bind({});
Default.args = {
  organizationName: "ABC Charities",
};