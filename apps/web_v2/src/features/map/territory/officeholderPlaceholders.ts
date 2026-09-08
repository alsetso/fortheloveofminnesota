/**
 * Default seat shells when a unit has no territory.seats rows yet.
 * Used for dock placeholders (+ add holder) in local development.
 */

export type SeatPlaceholder = {
  seat_type: string;
  title: string;
  sub_label?: string | null;
};

/** territory.units.kind (+ subtype for legislative). */
export function placeholderSeatsForUnitKind(
  kind: string,
  subtype?: string | null,
): SeatPlaceholder[] {
  switch (kind) {
    case 'county':
      return [{ seat_type: 'commissioner', title: 'County Commissioner' }];
    case 'ctu':
      return [
        { seat_type: 'mayor', title: 'Mayor' },
        { seat_type: 'council_member', title: 'Council Member', sub_label: 'At-large' },
      ];
    case 'school_district':
      return [{ seat_type: 'school_board_member', title: 'School Board Member' }];
    case 'congressional':
      return [{ seat_type: 'us_representative', title: 'U.S. Representative' }];
    case 'legislative':
      if (subtype === 'senate') {
        return [{ seat_type: 'state_senator', title: 'State Senator' }];
      }
      if (subtype === 'house') {
        return [{ seat_type: 'state_representative', title: 'State Representative' }];
      }
      return [];
    case 'zipcode':
      return [];
    default:
      return [{ seat_type: 'office', title: 'Office' }];
  }
}

/** Dock entity kind → same placeholders (when unit row isn’t loaded yet). */
export function placeholderSeatsForDockKind(kind: string): SeatPlaceholder[] {
  switch (kind) {
    case 'county':
      return placeholderSeatsForUnitKind('county');
    case 'ctu':
      return placeholderSeatsForUnitKind('ctu');
    case 'school_district':
      return placeholderSeatsForUnitKind('school_district');
    case 'district':
      return placeholderSeatsForUnitKind('congressional');
    case 'senate_district':
      return placeholderSeatsForUnitKind('legislative', 'senate');
    case 'house_district':
      return placeholderSeatsForUnitKind('legislative', 'house');
    default:
      return [];
  }
}
