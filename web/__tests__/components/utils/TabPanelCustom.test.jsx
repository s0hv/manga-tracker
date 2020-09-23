import React from 'react';
import { createMount, createShallow } from '@material-ui/core/test-utils';
import { TabPanelCustom } from '../../../src/components/utils/TabPanelCustom';

const DummyComponent = () => <span>test</span>;

describe('TabPanelCustom should handle rerender logic correctly', () => {
  it('Should render when initial index matches value', () => {
    const wrapper = createShallow()(
      <TabPanelCustom value={0} index={0}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(wrapper.exists(DummyComponent)).toBeTrue();
    expect(wrapper.exists('div[hidden=true]')).toBeFalse();
  });

  it('Should not render when initial index does not match value', () => {
    const wrapper = createShallow()(
      <TabPanelCustom value={0} index={1}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(wrapper.exists(DummyComponent)).toBeFalse();
    expect(wrapper.exists('div[hidden=true]')).toBeTrue();
  });

  it('Should not render when initial index does not match value and norerender is true', () => {
    const wrapper = createShallow()(
      <TabPanelCustom value={0} index={1} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(wrapper.exists(DummyComponent)).toBeFalse();
    expect(wrapper.exists('div[hidden=false]')).toBeTrue();
  });

  it('Should hide and not render the element on change', () => {
    const wrapper = createShallow()(
      <TabPanelCustom value={0} index={0}>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(wrapper.exists(DummyComponent)).toBeTrue();
    expect(wrapper.exists('div[hidden=false]')).toBeTrue();

    wrapper.setProps({ value: 1 });
    wrapper.update();

    expect(wrapper.exists(DummyComponent)).toBeFalse();
    expect(wrapper.exists('div[hidden=true]')).toBeTrue();
  });

  it('Should hide the element while keeping it rendered on change with noRerenderOnChange', () => {
    // https://github.com/enzymejs/enzyme/issues/2086
    const wrapper = createMount()(
      <TabPanelCustom value={0} index={0} noRerenderOnChange>
        <DummyComponent />
      </TabPanelCustom>
    );
    expect(wrapper.exists(DummyComponent)).toBeTrue();
    expect(wrapper.exists('div[hidden=false]')).toBeTrue();

    wrapper.setProps({ value: 1 });
    wrapper.update();

    expect(wrapper.exists(DummyComponent)).toBeTrue();
    expect(wrapper.exists('div[hidden=false]')).toBeTrue();

    let style = wrapper.find('div[hidden=false]').get(0).props.style;
    expect(style).toHaveProperty('display', 'none');

    wrapper.setProps({ value: 0 });
    wrapper.update();

    expect(wrapper.exists(DummyComponent)).toBeTrue();
    expect(wrapper.exists('div[hidden=false]')).toBeTrue();
    style = wrapper.find('div[hidden=false]').get(0).props.style;
    expect(style).toHaveProperty('display', undefined);
  });
});
