type ShopPurchaseButtonProps = {
  price: number;
  disabled: boolean;
  onClick?: () => void;
  className?: string;
};

export function ShopPurchaseButton({
  price,
  disabled,
  onClick,
  className = '',
}: ShopPurchaseButtonProps) {
  return (
    <button
      className={['shop-action-button', className].filter(Boolean).join(' ')}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span>购买</span>
      <em>${price}</em>
    </button>
  );
}
