import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EraserPanel } from './EraserPanel';
import { ERASER_MIN_SIZE, ERASER_MAX_SIZE } from '../utils/eraserConfig';

describe('EraserPanel', () => {
  it('affiche la taille courante de la gomme', () => {
    render(<EraserPanel size={24} onSizeChange={() => {}} />);
    expect(screen.getByText('24px')).toBeInTheDocument();
    expect(screen.getByLabelText('Taille de la gomme')).toHaveValue('24');
  });

  it('déplacer le slider appelle onSizeChange avec la nouvelle taille', () => {
    const onSizeChange = vi.fn();
    render(<EraserPanel size={20} onSizeChange={onSizeChange} />);
    const slider = screen.getByLabelText('Taille de la gomme');
    fireEvent.change(slider, { target: { value: '40' } });
    expect(onSizeChange).toHaveBeenCalledWith(40);
  });

  it('le slider est borné aux limites de la gomme', () => {
    render(<EraserPanel size={20} onSizeChange={() => {}} />);
    const slider = screen.getByLabelText('Taille de la gomme');
    expect(slider).toHaveAttribute('min', String(ERASER_MIN_SIZE));
    expect(slider).toHaveAttribute('max', String(ERASER_MAX_SIZE));
  });

  it('transmet une valeur numérique (pas une chaîne) au callback', () => {
    const onSizeChange = vi.fn();
    render(<EraserPanel size={20} onSizeChange={onSizeChange} />);
    fireEvent.change(screen.getByLabelText('Taille de la gomme'), { target: { value: '8' } });
    expect(onSizeChange).toHaveBeenCalledWith(8);
    expect(typeof onSizeChange.mock.calls[0][0]).toBe('number');
  });
});
