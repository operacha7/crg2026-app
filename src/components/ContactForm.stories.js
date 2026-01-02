import React from "react";
import ContactForm from "./ContactForm";

export default {
  title: "Components/ContactForm",
  component: ContactForm,
};

const Template = (args) => <ContactForm {...args} />;

export const Default = Template.bind({});
Default.args = {
  loggedInUser: {
    registered_organization: "CRG Houston"
  },
  onSubmitSuccess: () => console.log("Success callback triggered"),
};