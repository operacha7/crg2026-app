import React from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { LanguageProvider } from '../Contexts/LanguageContext';

export default {
  title: 'Components/LanguageSwitcher',
  component: LanguageSwitcher,
};

const Template = (args) => (
  <LanguageProvider>
    <LanguageSwitcher {...args} />
  </LanguageProvider>
);

export const Default = Template.bind({});
Default.args = {};