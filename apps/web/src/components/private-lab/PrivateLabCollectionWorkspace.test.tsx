/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  PrivateLabCollectionPanel,
  PrivateLabCollectionWorkspace,
} from './PrivateLabCollectionWorkspace';

describe('PrivateLabCollectionWorkspace', () => {
  it('provides one navigation rail and one collection surface', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PrivateLabCollectionWorkspace
          navigation={
            <PrivateLabCollectionPanel variant="navigation">集合导航</PrivateLabCollectionPanel>
          }
        >
          <PrivateLabCollectionPanel>集合内容</PrivateLabCollectionPanel>
        </PrivateLabCollectionWorkspace>,
      );
    });

    const workspace = container.querySelector('[data-slot="private-lab-collection-workspace"]');
    expect(workspace).not.toBeNull();
    expect(
      workspace?.querySelector('[data-slot="private-lab-collection-navigation"]')?.textContent,
    ).toContain('集合导航');
    expect(
      workspace?.querySelector('[data-slot="private-lab-collection-content"]')?.textContent,
    ).toContain('集合内容');
    expect(workspace?.querySelectorAll('[data-slot="private-lab-collection-panel"]')).toHaveLength(
      2,
    );
    expect(
      workspace
        ?.querySelector('[data-slot="private-lab-collection-navigation"] [data-variant]')
        ?.getAttribute('data-variant'),
    ).toBe('navigation');

    act(() => root.unmount());
    container.remove();
  });
});
